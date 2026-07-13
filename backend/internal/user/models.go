package user

type UserStatsResponse struct {
	Movies struct {
		TotalWatched        int `json:"total_watched"`
		TotalRuntimeMinutes int `json:"total_runtime_minutes"`
	} `json:"movies"`
	TV struct {
		TotalEpisodesWatched int `json:"total_episodes_watched"`
		TotalRuntimeMinutes  int `json:"total_runtime_minutes"`
	} `json:"tv"`
}

type UserWatchedRecord struct {
	TMDBID       int
	RewatchCount int
}
