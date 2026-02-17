export const config = {
    keywords: ["ijor"], // Default keywords, can be passed dynamically
    country: "IN",
    adCategory: "all",
    searchType: "keyword_exact_phrase",
    sortMode: "total_impressions",
    sortDirection: "desc",
    isPolitical: false, // Set to false for "All ads", true for "Issues, elections or politics"
    maxAdsPerDay: 1000,
    headless: false, // Set to true for production, false for debugging
};

export function getSearchUrl(keyword: string, country?: string) {
    const params = new URLSearchParams({
        active_status: "active",
        ad_type: config.isPolitical ? "political_and_issue_ads" : "all",
        country: country || config.country,
        is_targeted_country: "false",
        media_type: "all",
        q: `"${keyword}"`,
        search_type: config.searchType,
        "sort_data[direction]": config.sortDirection,
        "sort_data[mode]": config.sortMode,
    });

    return `https://www.facebook.com/ads/library/?${params.toString()}`;
}

export function getSearchUrlWithFilters(keyword: string, filters?: {
    language?: string;
    advertiser?: string;
    platforms?: string[];
    mediaType?: string;
    activeStatus?: string;
    startDate?: string;
    endDate?: string;
    country?: string;
}) {
    // Build base URL manually to handle array parameters correctly
    let url = 'https://www.facebook.com/ads/library/?';
    const params: string[] = [];

    // Active status filter
    const activeStatus = filters?.activeStatus === 'active' ? 'active' :
        filters?.activeStatus === 'inactive' ? 'inactive' : 'all';
    params.push(`active_status=${activeStatus}`);

    // Ad type
    params.push(`ad_type=${config.isPolitical ? 'political_and_issue_ads' : 'all'}`);

    // Country
    const country = filters?.country || config.country;
    params.push(`country=${country}`);
    params.push(`is_targeted_country=false`);

    // Media type filter
    const mediaType = filters?.mediaType && filters.mediaType !== 'all' ? filters.mediaType : 'all';
    params.push(`media_type=${mediaType}`);

    // Platform filter - use array notation like publisher_platforms[0]=whatsapp
    if (filters?.platforms && filters.platforms.length > 0) {
        filters.platforms.forEach((platform, index) => {
            params.push(`publisher_platforms[${index}]=${platform.toLowerCase()}`);
        });
    }

    // Keyword
    params.push(`q=${encodeURIComponent(`"${keyword}"`)}`);

    // Search type
    const searchType = filters?.language === 'en' ? 'keyword_unordered' : config.searchType;
    params.push(`search_type=${searchType}`);

    // Sort parameters
    params.push(`sort_data[direction]=${config.sortDirection}`);
    params.push(`sort_data[mode]=${config.sortMode}`);

    // Date range filters - use min/max notation
    if (filters?.startDate) {
        params.push(`start_date[min]=${filters.startDate}`);
    }
    if (filters?.endDate) {
        params.push(`start_date[max]=${filters.endDate}`);
    }

    // Advertiser filter
    if (filters?.advertiser && filters.advertiser !== 'all') {
        params.push(`advertiser_name=${encodeURIComponent(filters.advertiser)}`);
    }

    return url + params.join('&');
}
