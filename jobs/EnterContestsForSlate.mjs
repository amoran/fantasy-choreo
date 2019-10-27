import {FANDUEL_WRAPPER_HOST, LINEUP_API_HOST, INJURED_STATUSES} from '../constants.mjs';
import {
  getSlateDetails,
  getPlayers,
  getLineups,
  getContests,
  getEntriesFromDb,
  getUnenteredAlgoContestCombos,
  enterAlgoContestCombos,
  getGameStartTimes,
  scheduleSlatewideRostersUpdates
} from '../utils/util.mjs';

export default function(agenda, db) {
  agenda.define('EnterContestsForSlate', {priority: 'high', concurrency: 1}, async job => {
    const slateId = job.attrs.data.slate.id;
    
    console.log(`(EnterContestsForSlate) Entering all unentered contests for slate with id ${slateId}`);

    // 0 - Get Slate Details
    let slate = await getSlateDetails(slateId);
    slate === undefined ? console.log(`getSlateDetails returned undefined obj`) : '';
    
    // 1 - Get swappable and uninjured players
    let players = await getPlayers(slateId);
    players === undefined ? console.log(`getPlayers returned undefined obj`) : '';
    
    // 2 - Get lineups for each algo. 
    let lineups = await getLineups(players);
    lineups === undefined ? console.log(`getLineups returned undefined obj`) : '';
    
    // 3 - Get all contests for this slate (entered or not)
    let contests = await getContests(db, slateId);
    contests === undefined ? console.log(`getContests returned undefined obj`) : '';
    
    // 4 - Get entries from db
    let entries = await getEntriesFromDb(db, slateId);
    entries === undefined ? console.log(`getEntriesFromDb returned undefined obj`) : '';
    
    // 5 - Get unentered algo/contest combos
    let unenteredAlgoContestCombos = await getUnenteredAlgoContestCombos(lineups, contests, entries);
    unenteredAlgoContestCombos === undefined ? console.log(`getUnenteredAlgoContestCombos returned undefined obj`) : '';
    unenteredAlgoContestCombos && unenteredAlgoContestCombos.length === 0 ? console.log(`(EnterContestsForSlate) No contests to enter for slate with id ${slateId}`) : '';

    // 6 - Enter Algo/contest Combos
    await enterAlgoContestCombos(agenda, unenteredAlgoContestCombos);

    // 7 - Get game start times for this slate
    let startTimes = await getGameStartTimes(slate.fixtures);
    startTimes === undefined ? console.log(`getGameStartTimes returned undefined obj`) : '';
    
    // 8 - Schedule Updates for slate
    await scheduleSlatewideRostersUpdates(agenda, slate, startTimes);

  });
}