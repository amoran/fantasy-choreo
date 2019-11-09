import {FANDUEL_WRAPPER_HOST, LINEUP_API_HOST, INJURED_STATUSES} from '../constants.mjs';
import {
  getSlateDetails,
  getPlayers,
  filterOutNonSwappablePlayers,
  filterOutInjuredPlayers,
  getLineups,
  getContests,
  filterContests,
  getEntriesFromDb,
  getUnenteredAlgos,
  enterLineupsToContest,
  getUnenteredAlgoContestCombos,
  enterAlgoContestCombos,
  getGameStartTimes,
  scheduleSlatewideRostersUpdates
} from '../utils/util.mjs';

export default function(agenda, db) {
  agenda.define('EnterContestsForSlate', {priority: 'high', concurrency: 1}, async job => {
    const slateId = job.attrs.data.slate.id;
    const sport = job.attrs.data.sport;
    
    console.log(`(EnterContestsForSlate) Entering all unentered contests for slate with id ${slateId}`);

    // 0 - Get Slate Details
    let slate = await getSlateDetails(slateId);
    slate === undefined ? console.log(`getSlateDetails returned undefined obj`) : '';
    
    // 1 - Get swappable and uninjured players
    let players = await getPlayers(slateId);
    players === undefined ? console.log(`getPlayers returned undefined obj`) : '';
    
    // 2 - Filter players
    players = filterOutNonSwappablePlayers(players);
    players = filterOutInjuredPlayers(players);
    
    // 3 - Get lineups for each algo. 
    let lineups = await getLineups(players, sport);
    lineups === undefined ? console.log(`getLineups returned undefined obj`) : '';
    
    // 4 - Get all contests for this slate (entered or not)
    let contests = await getContests(db, slateId);
    contests === undefined ? console.log(`getContests returned undefined obj`) : '';

    // 4.5 - Filter contests
    let theContest = filterContests(contests, sport);
    theContest === undefined ? console.log(`filterContests returned undefined obj`) : '';
    
    // 5 - Get entries from db
    let entries = await getEntriesFromDb(db, slateId);
    entries === undefined ? console.log(`getEntriesFromDb returned undefined obj`) : '';

    // 6 Get unentered algorithms
    let unenteredAlgos = getUnenteredAlgos(slateId, lineups, entries);
    unenteredAlgos === undefined ? console.log(`getUnenteredAlgos returned undefined obj`) : '';
    
    // 7 Enter algos into contest
    if (theContest !== undefined) {
      await enterLineupsToContest(agenda, unenteredAlgos, theContest);
    }

    // 8 - Get game start times for this slate
    let startTimes = await getGameStartTimes(slate.fixtures);
    startTimes === undefined ? console.log(`getGameStartTimes returned undefined obj`) : '';
    
    // 9 - Schedule Updates for slate
    await scheduleSlatewideRostersUpdates(agenda, slate, startTimes, sport);

  });
}