/**
 * GD Studio 音乐台 MusicFree 插件
 *
 * 严格基于 GD Studio 官方 API 文档实现，仅使用以下四个接口：
 *   types=search  搜索（曲目 / 歌手 / 专辑关键字）
 *   types=url     获取播放链接（br: 128/192/320/740/999）
 *   types=pic     获取专辑图（size: 300/500）
 *   types=lyric   获取 LRC 歌词（原文 + 中文翻译）
 *
 * 数据来源：GD音乐台（music.gdstudio.xyz）
 * 仅供学习交流，严禁商用；使用请注明出处。
 */

const API_BASE = "https://music-api.gdstudio.xyz/api.php";

/** 每页请求条数（对应 API 的 count 参数，文档默认 20） */
const PAGE_SIZE = 20;

/** API 文档中列出的全部音乐源 */
const ALL_SOURCES = [
    "netease",
    "tencent",
    "kuwo",
    "tidal",
    "qobuz",
    "joox",
    "bilibili",
    "apple",
    "ytmusic",
    "spotify",
];

/** MusicFree 音质档位 -> API 的 br 参数 */
const BR_BY_QUALITY = {
    low: "128",
    standard: "192",
    high: "320",
    super: "999",
};

/** 当前搜索会话，用于音乐源不响应分页参数时的去重兜底 */
let searchSession = { keyword: "", seen: {} };

/** 读取插件设置中的音乐源，缺省为 netease */
function getCurrentSource() {
    let raw = "";
    try {
        const vars =
            typeof process !== "undefined" &&
            process.env &&
            process.env.userVariables;
        if (vars && typeof vars.source === "string") {
            raw = vars.source.trim().toLowerCase();
        }
    } catch (e) {
        // 读取配置失败时走默认源
    }
    if (ALL_SOURCES.indexOf(raw) >= 0) {
        return raw;
    }
    return "netease";
}

/** 歌曲对象会记住自己的来源，避免切换音乐源后旧歌失效 */
function getTrackSource(musicItem) {
    const src = musicItem && musicItem.gdSource;
    if (typeof src === "string" && ALL_SOURCES.indexOf(src) >= 0) {
        return src;
    }
    return getCurrentSource();
}

function toId(value) {
    if (value === undefined || value === null || value === "") {
        return undefined;
    }
    return String(value);
}

async function gdRequest(params) {
    const pairs = [];
    Object.keys(params).forEach(function (key) {
        const value = params[key];
        if (value !== undefined && value !== null && value !== "") {
            pairs.push(
                encodeURIComponent(key) +
                    "=" +
                    encodeURIComponent(String(value)),
            );
        }
    });
    const response = await fetch(API_BASE + "?" + pairs.join("&"), {
        method: "GET",
        headers: { Accept: "application/json" },
    });
    if (!response.ok) {
        throw new Error("GD API HTTP " + response.status);
    }
    const text = await response.text();
    if (!text) {
        return null;
    }
    try {
        return JSON.parse(text);
    } catch (e) {
        return null;
    }
}

async function search(keyword, page, type) {
    if (type !== "music" || !keyword || !keyword.trim()) {
        return { isEnd: true, data: [] };
    }
    const pageNum =
        typeof page === "number" && page >= 1 ? Math.floor(page) : 1;
    const source = getCurrentSource();

    // 每次新搜索的第一页重置去重会话
    if (pageNum === 1 || searchSession.keyword !== keyword) {
        searchSession = { keyword: keyword, seen: {} };
    }

    const result = await gdRequest({
        types: "search",
        source: source,
        name: keyword,
        count: PAGE_SIZE,
        pages: pageNum,
    });
    if (!Array.isArray(result)) {
        return { isEnd: true, data: [] };
    }

    const fresh = [];
    result.forEach(function (item) {
        const id = toId(item && item.id);
        if (!id || searchSession.seen[id]) {
            return;
        }
        searchSession.seen[id] = true;
        const artist = Array.isArray(item.artist)
            ? item.artist.join("/")
            : String(item.artist || "");
        fresh.push({
            id: id,
            title: item.name || "未知曲目",
            artist: artist || "未知歌手",
            album: item.album || undefined,
            gdSource: typeof item.source === "string" ? item.source : source,
            pic_id: toId(item.pic_id),
            lyric_id: toId(item.lyric_id),
        });
    });

    return {
        isEnd: fresh.length === 0 || result.length < PAGE_SIZE,
        data: fresh,
    };
}

async function getMediaSource(musicItem, quality) {
    const id = musicItem && toId(musicItem.id);
    if (!id) {
        return null;
    }
    const br = BR_BY_QUALITY[quality] || BR_BY_QUALITY.super;
    const result = await gdRequest({
        types: "url",
        source: getTrackSource(musicItem),
        id: id,
        br: br,
    });
    if (!result || !result.url || typeof result.url !== "string") {
        return null;
    }
    return {
        url: result.url,
        quality: quality,
    };
}

async function getMusicInfo(musicItem) {
    if (!musicItem) {
        return null;
    }
    // 封面按需加载：播放后由 MusicFree 合并到歌曲信息并更新通知栏
    if (musicItem.artwork) {
        return { artwork: musicItem.artwork };
    }
    const picId = toId(musicItem.pic_id);
    if (!picId) {
        return null;
    }
    const result = await gdRequest({
        types: "pic",
        source: getTrackSource(musicItem),
        id: picId,
        size: 500,
    });
    const url = result && result.url;
    if (!url || typeof url !== "string") {
        return null;
    }
    return { artwork: url };
}

async function getLyric(musicItem) {
    const id = musicItem && toId(musicItem.id);
    if (!id) {
        return null;
    }
    // lyric_id 一般与曲目 ID 相同，搜索结果里有则优先使用
    const lyricId = toId(musicItem.lyric_id) || id;
    const result = await gdRequest({
        types: "lyric",
        source: getTrackSource(musicItem),
        id: lyricId,
    });
    if (!result) {
        return null;
    }
    const rawLrc = typeof result.lyric === "string" ? result.lyric : "";
    const translation =
        typeof result.tlyric === "string" && result.tlyric
            ? result.tlyric
            : undefined;
    if (!rawLrc && !translation) {
        return null;
    }
    const lyric = { rawLrc: rawLrc };
    if (translation) {
        lyric.translation = translation;
    }
    return lyric;
}

const plugin = {
    platform: "GD音乐台",
    version: "1.0.0",
    author: "GD Studio",
    description: [
        "基于 GD Studio 官方 API 实现：搜索 / 播放 / 歌词 / 封面。",
        "",
        "数据来源：GD音乐台（music.gdstudio.xyz）。",
        "仅供学习交流，严禁下载、传播或商用。",
        "",
        "可在插件设置中切换音乐源，默认 netease；",
        "部分音乐源可能暂不开放，建议 netease / joox / bilibili。",
    ].join("\n"),
    supportedSearchType: ["music"],
    defaultSearchType: "music",
    userVariables: [
        {
            key: "source",
            name: "音乐源",
            hint: "netease / joox / bilibili / tencent / kuwo / tidal / qobuz / apple / ytmusic / spotify",
        },
    ],
    search: search,
    getMediaSource: getMediaSource,
    getMusicInfo: getMusicInfo,
    getLyric: getLyric,
};

module.exports = plugin;
