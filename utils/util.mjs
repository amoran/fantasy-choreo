import axios from 'axios';
import util from 'util';
import {FANDUEL_WRAPPER_HOST, LINEUP_API_HOST, INJURED_STATUSES, PRE_GAME_UPDATE_TIME} from '../constants.mjs';


// 0 - Get Slate Details
export const getSlateDetails = (slateId) => {
  return axios.get(`${FANDUEL_WRAPPER_HOST}/slates/${slateId}`)
    .then(slateResponse => {
      return slateResponse.data;
    })
    .catch(error => {
      console.error(`(util/getSlateDetails) error`);
      console.error(error);
    })
};


// 1 - Get ALL Players
export const getPlayers = (slateId) => {
  return axios.get(`${FANDUEL_WRAPPER_HOST}/slates/${slateId}/players`)
    .then(playersResponse => {

      // Clean up the fppg field and add the name field.
      let players = playersResponse.data.map(player => {
        return {
          ...player,
          fppg: player.fppg || 0,
          name: `${player.first_name} ${player.last_name}`
        }
      });

      return players;
    })
    .catch(error => {
      console.error(`(util/getPlayers) error`);
      console.error(error);
    });
};

// Remove Non swappable players
export const filterOutNonSwappablePlayers = (players) => {
  // Make sure players are swappable
  let swappablePlayers = players.filter(player => {
    return player.swappable;
  });

  return swappablePlayers;
}

// Remove injured players
export const filterOutInjuredPlayers = (players) => {
  let nonInjuredPlayers = players.filter(player => {
    let playerIsNotInjured = !INJURED_STATUSES.includes((player.injury_status || '').toLowerCase());
    return playerIsNotInjured;
  });

  return nonInjuredPlayers;
}


// 2 - Get lineups for each algo. 
export const getLineups = (players, sport) => {
  sport = sport || 'nfl';
  return axios.post(`${LINEUP_API_HOST}/api/${sport}/lineup`, players)
    .then(lineupResponse => {

      // Make sure lineups have all 9 players in them.
      let ninePlayerLineups = lineupResponse.data.filter(lineup => {
        return lineup.players.length === 9;
      });

      // TODO: Filter out lineups with MORE THAN 4 players from a single team.

      return ninePlayerLineups;
    })
    .catch(error => {
      console.error(`(util/getLineups) error`);
      console.error(error);
    });
};


// 3 - Get all contests for this slate (entered or not)
export const getContests = (db, slateId) => {
  let contestTypes = 'TOURNAMENT'; //comma separated list

  return axios.get(`${FANDUEL_WRAPPER_HOST}/slates/${slateId}/contests?type=${contestTypes}`)
    .then(contestsResponse => {

      // Upsert all contests to db for future reference
      contestsResponse.data.forEach(contest => {
        db.collection('contests').updateOne({id: contest.id}, {$set: contest}, {upsert: true}, (err, res) => {
          if (err) {
            console.error(`(util/getContests) error putting contest ${contest.id} into db`);
            console.error(err);
            return;
          }             
        });
      });

      return contestsResponse.data;
    })
    .catch(error => {
      console.error(`(util/getContests) error`);
      console.error(error);
    });
};

export const filterContests = (contests) => {

  let filteredContests = [];
  
  filteredContests = contests.filter(contest => {
    let isNotFull = contest.entries.count < contest.size.max;
    let isLargeContest = contest.size.max > 100;
    let isLowCost = contest.entry_fee <= 0.25;
    let isNotRestricted = contest.restricted === false;
    let isMonetaryPrize = contest.prizes.total > 0;
    let canEnterAllLineups = contest.max_entries_per_user >= 9;

    return (
      isNotFull && 
      isLargeContest && 
      isLowCost && 
      isNotRestricted && 
      isMonetaryPrize &&
      canEnterAllLineups
    );
  });

  // Retry filtering with non monetary prize as option.
  if (filteredContests.length === 0) {
    filteredContests = contests.filter(contest => {
      let isNotFull = contest.entries.count < contest.size.max;
      let isLargeContest = contest.size.max >= 100;
      let isLowCost = contest.entry_fee <= 0.25;
      let isNotRestricted = contest.restricted === false;
      let canEnterAllLineups = contest.max_entries_per_user >= 9;
      
      return (
        isNotFull && 
        isLargeContest && 
        isLowCost && 
        isNotRestricted &&
        canEnterAllLineups
      );
    });
  }

  // Choose contest with lowest entry cost
  return filteredContests.sort((contest1, contest2) => {
    // Off right now: highest prize
    // let prizeSize1 = contest1.prizes.total;
    // let prizeSize2 = contest2.prizes.total;
    // return prizeSize1 < prizeSize2;

    let entryCost1 = contest1.entry_fee;
    let entryCost2 = contest2.entry_fee;
    return entryCost1 > entryCost2;
  })[0];
}


// 4 - Get entries from db
export const getEntriesFromDb = (db, slateId) => {
  return db.collection('entries2').find({slateId: slateId}).toArray()
    .then(res => {
      return res;
    })
    .catch(err => {
      if (err) {
        console.error(`(util/getEntriesFromDb) error fetching entries from db with slateId ${slateId}`);
        console.error(err);
      }             
    });
};


// Get lineups whose algorithm has not been entered into a contest in this slate.
export const getUnenteredAlgos = (slateid, lineups, entries) => {
  let algos = lineups.map(lineup => lineup.algorithm);
  let entriesForThisSlate = entries.filter(entry => entry.slateId === slateid);
  let algosEntered = entriesForThisSlate.map(entry => entry.algorithm);

  let unenteredAlgos = algos.filter(algo => {
    return !algosEntered.includes(algo);
  });

  return unenteredAlgos.map(algo => {
    return lineups.find(lineup => lineup.algorithm === algo);
  });
}


export const enterLineupsToContest = (agenda, unenteredLineups, theContest) => {
  unenteredLineups.forEach(lineup => {
    console.log(`Entering contest ${theContest.id} for lineup ${lineup.algorithm}`);
    agenda.now('JoinContest', {
      contestId: theContest.id,
      lineup
    });
  });
}


// 5 - Get unentered algo/contest combos
export const getUnenteredAlgoContestCombos = (lineups, contests, entries) => {
  let algos = lineups.map(lineup => lineup.algorithm);
  let allContestIds = contests.map(contest => contest.id);

  // Create a map object like {algo1: [contest1, contest2], algo2: [contest2, contest3]}
  let enteredContestIdsByAlgo = entries.reduce((acc, entry) => {
    if (acc[entry.algorithm]) {
      acc[entry.algorithm].push(entry.contestId);
    } else {
      acc[entry.algorithm] = [entry.contestId];
    }

    return acc;
  }, {});

  let unenteredContests = algos.map(algorithm => {
    let enteredContestIds = enteredContestIdsByAlgo[algorithm] || [];

    let unenteredContestIds = allContestIds.filter(contestId => {
      return enteredContestIds.indexOf(contestId) < 0;
    });

    return unenteredContestIds.map(contestId => {
      return {
        lineup: lineups.find(lineup => lineup.algorithm === algorithm),
        contestId
      };
    });
  });


  // Returns [{lineup1, contestId1}, {lineup1, contestId2}, {lineup2, contestId2}, ...]
  return unenteredContests.reduce((acc, algoGroup) => {
    return acc.concat(algoGroup);
  }, []);
};


// 6 - Enter Algo/contest Combos - Accepts [{lineup1, contestId1}, {lineup1, contestId2}, {lineup2, contestId2}, ...]
export const enterAlgoContestCombos = (agenda, unenteredAlgoContestCombos) => {
  unenteredAlgoContestCombos.forEach(algoContestCombo => {
    console.log(`Entering contest ${algoContestCombo.contestId}`);
    agenda.now('JoinContest', {
      contestId: algoContestCombo.contestId,
      lineup: algoContestCombo.lineup
    });
  });
};


// 7 - Get game start times for this slate
export const getGameStartTimes = (fixtures) => {

  // Get all start dates into an array of strings
  let startDates = fixtures.map(game => game.start_date);

  // Remove duplicates
  return startDates.filter((date, index, self) => self.indexOf(date) === index);
};


// 8 - Schedule Updates for slate
export const scheduleSlatewideRostersUpdates = (agenda, slate, startDates, sport) => {
  agenda.jobs({name: 'UpdateRostersInSlate', nextRunAt: {$ne: null}})
    .then(jobs => {
      let thisSlatesJobs = jobs.filter(job => {
        return slate.fixture_lists[0].id === job.attrs.data.slate.fixture_lists[0].id;
      });

      startDates.forEach(startDate => {
        const newStartDate = new Date(new Date(startDate) - (1000 * 60 * PRE_GAME_UPDATE_TIME));

        let existingJob = thisSlatesJobs.find(job => {
          return (new Date(job.attrs.nextRunAt)).getTime() == newStartDate.getTime();
        });

        if (existingJob) {
          console.log(`Already scheduled update for: ${newStartDate} for ${slate.fixture_lists[0].id}`)          
        } else {
          console.log(`Scheduling update for: ${newStartDate} for ${slate.fixture_lists[0].id}`)
          agenda.schedule(newStartDate, 'UpdateRostersInSlate', {slate: slate, sport: sport});
        }
      });

    });
  
};

/*
 * For UpdateRostersInSlate 
 * 
 */

 // 3 - Get rosters for entries (deduped). rosters = [{rosterId, algorithm, players}]
export const getRostersForEntries = (entries) => {
  let uniqueRosterIds = [];
  let uniqueEntries = [];

  // Find unique rosterIds;
  for (let i=0; i<entries.length; i++) {
    let curRosterId = entries[i].rosterId;
    if (!uniqueRosterIds.includes(curRosterId)) {
      uniqueRosterIds.push(curRosterId);
      uniqueEntries.push(entries[i]);
    }
  }

  // let uniqueEntries = entries.filter((entry, index) => {
  //   return index === entries.findIndex(entry2 => {
  //     entry.rosterId === entry2.rosterId;
  //   });
  // });

  // Return new format: [{rosterId, algorithm, players}]
  return uniqueEntries.map(entry => {
    return {
      rosterId: entry.rosterId,
      algorithm: entry.algorithm,
      players: entry.players[entry.players.length - 1]
    };
  })

  return;
}
 
// 4 - Add used positions to rosters. rosters = [{rosterId, algorithm, players, usedPositions}]
export const addUsedPositionsToRosters = (rosters, players) => {

  // if a player in a roster is not in the players list, they must have been used already.
  return rosters.map(roster => {
    let usedPlayers = roster.players.filter(rosterPlayer => {
      let foundPlayer = players.find(player => player.id === rosterPlayer.id);
      return foundPlayer && foundPlayer.swappable === false;
    });

    let usedPositions = usedPlayers.map(player => player.position);
    console.log(`For rosterId ${roster.rosterId}, usedPositions was ${usedPositions}`)

    return {
      ...roster,
      usedPositions
    }

  });

}

// 5 - Add remaining salary to rosters. rosters = [{rosterId, algorithm, players, usedPositions, remainingSalary}]
export const addRemainingSalaryToRosters = (rosters, players, totalSalary) => {

  // if a player in a roster is not in the players list, they must have been used already.
  return rosters.map(roster => {
    let usedPlayers = roster.players.filter(rosterPlayer => {
      let foundPlayer = players.find(player => player.id === rosterPlayer.id);
      return foundPlayer && foundPlayer.swappable === false;
    });

    let usedSalaries = usedPlayers.map(player => player.salary);
    let usedTotal = usedSalaries.reduce((acc, salary) => acc + salary, 0);

    console.log(`For rosterId ${roster.rosterId}, remainingSalary was ${totalSalary - usedTotal}`)    

    return {
      ...roster,
      remainingSalary: totalSalary - usedTotal
    };

  });

}

// 6 - Get Lineup Updates
export const getLineupUpdates = (players, usedPositions, algorithm, remainingSalary, sport) => {
  // Filter out non swappable players
  let swappablePlayers = filterOutNonSwappablePlayers(players);
  swappablePlayers === undefined ? console.log(`filterOutNonSwappablePlayers returned undefined obj`) : '';

  // Filter out injured players
  let availablePlayers = filterOutInjuredPlayers(swappablePlayers);
  availablePlayers === undefined ? console.log(`filterOutInjuredPlayers returned undefined obj`) : '';

  return axios.post(`${LINEUP_API_HOST}/api/${sport}/lineup/${algorithm}`, {
    available: availablePlayers,
    usedPositions,
    remainingSalary
  })
    .then(lineupResponse => {
      return lineupResponse.data;
    })
    .catch(error => {
      console.error(`(util/getLineupUpdates) error`);
      console.error(error);
    })
}

// 7 - Merge lineup updates with current players list
export const addUpdatesToLineup = (players, roster, lineupUpdates) => {
  let usedPlayers = roster.players.filter(rosterPlayer => {
    let foundPlayer = players.find(player => player.id === rosterPlayer.id);
    return foundPlayer && foundPlayer.swappable === false;
  });

  console.log(`For rosterId ${roster.rosterId}, usedPlayers were ${JSON.stringify(usedPlayers)} and updates were ${JSON.stringify(lineupUpdates.players)}`);    
  
  return usedPlayers.concat(lineupUpdates.players);
}

// 8 - Check diff
export const isSameLineup = (lineup1, lineup2) => {
  return lineup1.every(player1 => {
    return lineup2.some(player2 => {
      return player2.id === player1.id
    });
  });
}

// 9 - Update the roster with the new lineup
export const updateRoster = (agenda, rosterId, lineupPlayers, algorithm) => {
  agenda.now('UpdateRoster', {rosterId, lineup: {players: lineupPlayers, algorithm}});
}
