package user

type UserStatsResponse struct {
	Movies MovieStats `json:"movies"`
	TV     TVStats    `json:"tv"`
}

type MovieStats struct {
	TotalWatched        int `json:"total_watched"`
	TotalRuntimeMinutes int `json:"total_runtime_minutes"`
}

type TVStats struct {
	TotalEpisodesWatched int `json:"total_episodes_watched"`
	TotalRuntimeMinutes  int `json:"total_runtime_minutes"`
}

type UserWatchedRecord struct {
	TMDBID       int
	RewatchCount int
}
