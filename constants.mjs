export const FANDUEL_WRAPPER_HOST = 'http://adam-moran.com:6868';
export const MONGO_CONN_STR = 'mongodb://adam-moran.com:6969';
export const LINEUP_API_HOST = 'http://fantasypy.herokuapp.com';

// Don't keep players in lineup that are Doubtful, Injured Reserve, NA, or Out
export const INJURED_STATUSES = ['d', 'ir', 'na', 'o'];

// Number of minutes before each game to update the lineups
export const PRE_GAME_UPDATE_TIME = 10;
