import {
  getAllPlayers,
  filterNonSwappablePlayers,
  filterValidPlayers,
  getEntriesFromDb,
  getRostersForEntries,
  addUsedPositionsToRosters,
  addRemainingSalaryToRosters,
  getLineupUpdates,
  addUpdatesToLineup,
  updateRoster,
  isSameLineup
} from '../utils/util.mjs';

export default function(agenda, db) {
  agenda.define('UpdateRostersInSlate', {priority: 'high', concurrency: 1}, async job => {
    const slateId = job.attrs.data.slate.fixture_lists[0].id;
    const totalSalary = job.attrs.data.slate.fixture_lists[0].salary_cap;

    console.log(`(UpdateRostersInSlate) Updating rosters for slateId ${slateId} with totalSalary ${totalSalary}`);

    // 1 - Get swappable and uninjured players
    let allPlayers = await getAllPlayers(slateId);
    allPlayers === undefined ? console.log(`getPlayers returned undefined obj`) : '';

    // Filter out non swappable players
    let swappablePlayers = filterNonSwappablePlayers(allPlayers);
    swappablePlayers === undefined ? console.log(`filterNonSwappablePlayers returned undefined obj`) : '';

    // Filter swappable players
    let players = filterValidPlayers(allPlayers);
    players === undefined ? console.log(`filterValidPlayers returned undefined obj`) : '';
    
    // 2 - Get entries from db
    let entries = await getEntriesFromDb(db, slateId);
    entries === undefined ? console.log(`getEntriesFromDb returned undefined obj`) : '';
    
    // 3 - Get rosters for entries (deduped). rosters = [{rosterId, algorithm, players}]
    let rosters = getRostersForEntries(entries);
    rosters === undefined ? console.log(`getRostersForEntries returned undefined obj`) : '';
    
    // 4 - Add used positions to rosters. rosters = [{rosterId, algorithm, players, usedPositions}]
    rosters = addUsedPositionsToRosters(rosters, swappablePlayers);
    rosters === undefined ? console.log(`addUsedPositionsToRosters returned undefined obj`) : '';
    
    // 5 - Add remaining salary to rosters. rosters = [{rosterId, algorithm, players, usedPositions, remainingSalary}]
    rosters = addRemainingSalaryToRosters(rosters, players, totalSalary);
    rosters === undefined ? console.log(`addRemainingSalaryToRosters returned undefined obj`) : '';
    
    // 6 - Create new lineup
    for (const roster of rosters) {

      // Get lineup updates from lineup generator API
      let lineupUpdates = await getLineupUpdates(players, roster.usedPositions, roster.algorithm, roster.remainingSalary);

      // Combine updates with existing lineup to get new one
      let newLineup = addUpdatesToLineup(players, roster, lineupUpdates);

      // Update the roster if a new lineup was generated
      if (!isSameLineup(newLineup, roster.players)) {
        console.log(`Diff lineup generated for rosterId ${roster.rosterId} and algo ${roster.algorithm}`)
        await updateRoster(agenda, roster.rosterId, newLineup, roster.algorithm);
      } else {
        console.log(`Same lineup generated for rosterId ${roster.rosterId} and algo ${roster.algorithm}`)        
      }
    };

  });
}