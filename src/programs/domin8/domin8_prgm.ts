/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/domin8_prgm.json`.
 */
export type Domin8Prgm = {
  "address": "8BH1JMeZCohtUKcfGGTqpYjpwxMowZBi6HrnAhc6eJFz",
  "metadata": {
    "name": "domin8Prgm",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "cleanupOldGame",
      "docs": [
        "Cleanup old game round (backend-triggered after 1 week)"
      ],
      "discriminator": [
        108,
        187,
        63,
        87,
        253,
        127,
        241,
        166
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  97,
                  109,
                  101,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "counter",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  97,
                  109,
                  101,
                  95,
                  99,
                  111,
                  117,
                  110,
                  116,
                  101,
                  114
                ]
              }
            ]
          }
        },
        {
          "name": "gameRound",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  97,
                  109,
                  101,
                  95,
                  114,
                  111,
                  117,
                  110,
                  100
                ]
              },
              {
                "kind": "arg",
                "path": "roundId"
              }
            ]
          }
        },
        {
          "name": "crank",
          "docs": [
            "The crank authority (backend wallet)"
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "roundId",
          "type": "u64"
        }
      ]
    },
    {
      "name": "closeBettingWindow",
      "docs": [
        "Close betting window and lock game for winner selection"
      ],
      "discriminator": [
        145,
        48,
        50,
        174,
        220,
        228,
        120,
        9
      ],
      "accounts": [
        {
          "name": "counter",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  97,
                  109,
                  101,
                  95,
                  99,
                  111,
                  117,
                  110,
                  116,
                  101,
                  114
                ]
              }
            ]
          }
        },
        {
          "name": "gameRound",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  97,
                  109,
                  101,
                  95,
                  114,
                  111,
                  117,
                  110,
                  100
                ]
              },
              {
                "kind": "account",
                "path": "counter.current_round_id",
                "account": "gameCounter"
              }
            ]
          }
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  97,
                  109,
                  101,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "crank",
          "docs": [
            "The crank authority"
          ],
          "signer": true
        }
      ],
      "args": []
    },
    {
      "name": "createGame",
      "docs": [
        "Create a new game round with the first bet (called by first player)"
      ],
      "discriminator": [
        124,
        69,
        75,
        66,
        184,
        220,
        72,
        206
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  97,
                  109,
                  101,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "counter",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  97,
                  109,
                  101,
                  95,
                  99,
                  111,
                  117,
                  110,
                  116,
                  101,
                  114
                ]
              }
            ]
          }
        },
        {
          "name": "gameRound",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  97,
                  109,
                  101,
                  95,
                  114,
                  111,
                  117,
                  110,
                  100
                ]
              },
              {
                "kind": "account",
                "path": "counter.current_round_id",
                "account": "gameCounter"
              }
            ]
          }
        },
        {
          "name": "betEntry",
          "docs": [
            "First bet entry PDA (bet_index = 0)"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "counter.current_round_id",
                "account": "gameCounter"
              },
              {
                "kind": "const",
                "value": [
                  0,
                  0,
                  0,
                  0
                ]
              }
            ]
          }
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "player",
          "writable": true,
          "signer": true
        },
        {
          "name": "vrfProgram",
          "docs": [
            "ORAO VRF Program"
          ],
          "address": "VRFzZoJdhFWL8rkvu87LpKM3RbcVezpMEc6X5GVDr7y"
        },
        {
          "name": "networkState",
          "docs": [
            "ORAO Network State (validated as PDA from ORAO VRF program)"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  111,
                  114,
                  97,
                  111,
                  45,
                  118,
                  114,
                  102,
                  45,
                  110,
                  101,
                  116,
                  119,
                  111,
                  114,
                  107,
                  45,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103,
                  117,
                  114,
                  97,
                  116,
                  105,
                  111,
                  110
                ]
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                7,
                71,
                177,
                26,
                250,
                145,
                180,
                209,
                249,
                34,
                242,
                123,
                14,
                186,
                193,
                218,
                178,
                59,
                33,
                41,
                164,
                190,
                243,
                79,
                50,
                164,
                123,
                88,
                245,
                206,
                252,
                120
              ]
            }
          }
        },
        {
          "name": "treasury",
          "docs": [
            "ORAO Treasury"
          ],
          "writable": true
        },
        {
          "name": "vrfRequest",
          "docs": [
            "VRF Request Account (will be created by ORAO VRF program)"
          ],
          "writable": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "initialize",
      "docs": [
        "Initialize the game with configuration"
      ],
      "discriminator": [
        175,
        175,
        109,
        31,
        13,
        152,
        155,
        237
      ],
      "accounts": [
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  97,
                  109,
                  101,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "counter",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  97,
                  109,
                  101,
                  95,
                  99,
                  111,
                  117,
                  110,
                  116,
                  101,
                  114
                ]
              }
            ]
          }
        },
        {
          "name": "vault",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "treasury",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "placeBet",
      "docs": [
        "Place an additional bet in the current game round (called by subsequent players)"
      ],
      "discriminator": [
        222,
        62,
        67,
        220,
        63,
        166,
        126,
        33
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  97,
                  109,
                  101,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "counter",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  97,
                  109,
                  101,
                  95,
                  99,
                  111,
                  117,
                  110,
                  116,
                  101,
                  114
                ]
              }
            ]
          }
        },
        {
          "name": "gameRound",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  97,
                  109,
                  101,
                  95,
                  114,
                  111,
                  117,
                  110,
                  100
                ]
              },
              {
                "kind": "account",
                "path": "counter.current_round_id",
                "account": "gameCounter"
              }
            ]
          }
        },
        {
          "name": "betEntry",
          "docs": [
            "CREATE: BetEntry PDA for storing bet details"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "counter.current_round_id",
                "account": "gameCounter"
              },
              {
                "kind": "account",
                "path": "game_round.bet_count",
                "account": "gameRound"
              }
            ]
          }
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "player",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "selectWinnerAndPayout",
      "docs": [
        "Select winner using VRF and distribute payouts"
      ],
      "discriminator": [
        84,
        212,
        130,
        51,
        181,
        63,
        89,
        24
      ],
      "accounts": [
        {
          "name": "counter",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  97,
                  109,
                  101,
                  95,
                  99,
                  111,
                  117,
                  110,
                  116,
                  101,
                  114
                ]
              }
            ]
          }
        },
        {
          "name": "gameRound",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  97,
                  109,
                  101,
                  95,
                  114,
                  111,
                  117,
                  110,
                  100
                ]
              },
              {
                "kind": "account",
                "path": "counter.current_round_id",
                "account": "gameCounter"
              }
            ]
          }
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  97,
                  109,
                  101,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "vault",
          "docs": [
            "The vault PDA that holds game funds"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "crank",
          "docs": [
            "The crank authority"
          ],
          "signer": true
        },
        {
          "name": "vrfRequest",
          "docs": [
            "VRF Request Account containing fulfilled randomness"
          ]
        },
        {
          "name": "treasury",
          "docs": [
            "Treasury account for receiving house fees"
          ],
          "writable": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    }
  ],
  "accounts": [
    {
      "name": "betEntry",
      "discriminator": [
        32,
        21,
        144,
        65,
        176,
        182,
        3,
        204
      ]
    },
    {
      "name": "gameConfig",
      "discriminator": [
        45,
        146,
        146,
        33,
        170,
        69,
        96,
        133
      ]
    },
    {
      "name": "gameCounter",
      "discriminator": [
        117,
        67,
        148,
        185,
        138,
        194,
        249,
        87
      ]
    },
    {
      "name": "gameRound",
      "discriminator": [
        69,
        45,
        252,
        31,
        254,
        31,
        101,
        146
      ]
    },
    {
      "name": "networkState",
      "discriminator": [
        212,
        237,
        148,
        56,
        97,
        245,
        51,
        169
      ]
    }
  ],
  "events": [
    {
      "name": "betPlaced",
      "discriminator": [
        88,
        88,
        145,
        226,
        126,
        206,
        32,
        0
      ]
    },
    {
      "name": "gameInitialized",
      "discriminator": [
        82,
        221,
        11,
        2,
        244,
        52,
        240,
        250
      ]
    },
    {
      "name": "gameLocked",
      "discriminator": [
        137,
        134,
        142,
        42,
        168,
        51,
        224,
        76
      ]
    },
    {
      "name": "gameReset",
      "discriminator": [
        171,
        230,
        62,
        202,
        158,
        128,
        127,
        240
      ]
    },
    {
      "name": "winnerSelected",
      "discriminator": [
        245,
        110,
        152,
        173,
        193,
        48,
        133,
        5
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "invalidGameStatus",
      "msg": "Invalid game status for this action"
    },
    {
      "code": 6001,
      "name": "unauthorized",
      "msg": "Unauthorized: only authority can perform this action"
    },
    {
      "code": 6002,
      "name": "bettingPhaseClosed",
      "msg": "Betting phase is closed"
    },
    {
      "code": 6003,
      "name": "betTooSmall",
      "msg": "Bet amount is below minimum required"
    },
    {
      "code": 6004,
      "name": "maxPlayersReached",
      "msg": "Maximum number of players reached"
    },
    {
      "code": 6005,
      "name": "playerNotFound",
      "msg": "Player not found in current game"
    },
    {
      "code": 6006,
      "name": "randomnessNotResolved",
      "msg": "Switchboard randomness value is not yet available for the committed slot"
    },
    {
      "code": 6007,
      "name": "invalidRandomnessAccount",
      "msg": "The provided Switchboard randomness account is not valid for the current game round"
    },
    {
      "code": 6008,
      "name": "commitSlotNotElapsed",
      "msg": "The committed slot has not elapsed yet"
    },
    {
      "code": 6009,
      "name": "notASpectator",
      "msg": "A finalist cannot place a spectator bet"
    },
    {
      "code": 6010,
      "name": "finalistNotFound",
      "msg": "Target finalist not found"
    },
    {
      "code": 6011,
      "name": "insufficientFunds",
      "msg": "Insufficient funds for bet"
    },
    {
      "code": 6012,
      "name": "mathOverflow",
      "msg": "Mathematical overflow occurred"
    },
    {
      "code": 6013,
      "name": "noWinnerDetermined",
      "msg": "No winner has been determined yet"
    },
    {
      "code": 6014,
      "name": "invalidGameType",
      "msg": "Invalid game type for this operation"
    },
    {
      "code": 6015,
      "name": "noWinnerSet",
      "msg": "No winner has been set"
    },
    {
      "code": 6016,
      "name": "noFinalistsSet",
      "msg": "No finalists have been set"
    },
    {
      "code": 6017,
      "name": "payoutExceedsAvailableFunds",
      "msg": "Payout amount exceeds available funds"
    },
    {
      "code": 6018,
      "name": "alreadyClaimed",
      "msg": "Winnings have already been claimed"
    },
    {
      "code": 6019,
      "name": "noWinningsFound",
      "msg": "No winnings found for this wallet"
    },
    {
      "code": 6020,
      "name": "houseFeeAlreadyCollected",
      "msg": "House fee has already been collected"
    },
    {
      "code": 6021,
      "name": "gameAlreadyReset",
      "msg": "Game has already been reset"
    },
    {
      "code": 6022,
      "name": "invalidVrfAccount",
      "msg": "VRF account is invalid"
    },
    {
      "code": 6023,
      "name": "randomnessNotFulfilled",
      "msg": "Randomness not yet fulfilled"
    },
    {
      "code": 6024,
      "name": "vrfRequestFailed",
      "msg": "VRF request failed"
    },
    {
      "code": 6025,
      "name": "invalidVrfSeed",
      "msg": "Invalid VRF seed"
    },
    {
      "code": 6026,
      "name": "invalidWinnerAccount",
      "msg": "Invalid winner account"
    },
    {
      "code": 6027,
      "name": "invalidTreasury",
      "msg": "Invalid treasury account"
    },
    {
      "code": 6028,
      "name": "noPlayers",
      "msg": "No players in game"
    },
    {
      "code": 6029,
      "name": "invalidBetAmount",
      "msg": "Invalid bet amount"
    },
    {
      "code": 6030,
      "name": "arithmeticOverflow",
      "msg": "Arithmetic overflow occurred"
    },
    {
      "code": 6031,
      "name": "emergencyTimeNotElapsed",
      "msg": "Emergency time threshold not yet elapsed"
    },
    {
      "code": 6032,
      "name": "noFundsToRefund",
      "msg": "No funds available to refund"
    },
    {
      "code": 6033,
      "name": "bettingWindowClosed",
      "msg": "Betting window has closed"
    },
    {
      "code": 6034,
      "name": "bettingWindowStillOpen",
      "msg": "Betting window is still open"
    },
    {
      "code": 6035,
      "name": "betsLocked",
      "msg": "Bets are locked during resolution"
    },
    {
      "code": 6036,
      "name": "cannotCleanupActiveGame",
      "msg": "Cannot cleanup active or current game"
    },
    {
      "code": 6037,
      "name": "gameTooRecentToCleanup",
      "msg": "Game is too recent to cleanup (must be older than 1 week)"
    },
    {
      "code": 6038,
      "name": "maxBetsReached",
      "msg": "Maximum number of bets reached (64 max)"
    }
  ],
  "types": [
    {
      "name": "betEntry",
      "docs": [
        "Individual bet stored as separate PDA",
        "Seeds: [b\"bet\", game_round_id.to_le_bytes(), bet_index.to_le_bytes()]"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "gameRoundId",
            "type": "u64"
          },
          {
            "name": "betIndex",
            "type": "u32"
          },
          {
            "name": "wallet",
            "type": "pubkey"
          },
          {
            "name": "betAmount",
            "type": "u64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          },
          {
            "name": "payoutCollected",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "betPlaced",
      "docs": [
        "Event emitted when a bet is placed"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "roundId",
            "type": "u64"
          },
          {
            "name": "player",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "betCount",
            "type": "u8"
          },
          {
            "name": "totalPot",
            "type": "u64"
          },
          {
            "name": "endTimestamp",
            "type": "i64"
          },
          {
            "name": "isFirstBet",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "gameConfig",
      "docs": [
        "Global game configuration stored as singleton PDA",
        "Seeds: [b\"game_config\"]"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "treasury",
            "type": "pubkey"
          },
          {
            "name": "houseFeeBasisPoints",
            "type": "u16"
          },
          {
            "name": "minBetLamports",
            "type": "u64"
          },
          {
            "name": "smallGameDurationConfig",
            "type": {
              "defined": {
                "name": "gameDurationConfig"
              }
            }
          },
          {
            "name": "betsLocked",
            "type": "bool"
          },
          {
            "name": "force",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          }
        ]
      }
    },
    {
      "name": "gameCounter",
      "docs": [
        "Global counter tracking current game round",
        "Seeds: [b\"game_counter\"]"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "currentRoundId",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "gameDurationConfig",
      "docs": [
        "Configuration for game durations"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "waitingPhaseDuration",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "gameInitialized",
      "docs": [
        "Event emitted when a new game round is initialized"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "roundId",
            "type": "u64"
          },
          {
            "name": "startTimestamp",
            "type": "i64"
          },
          {
            "name": "endTimestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "gameLocked",
      "docs": [
        "Event emitted when game is locked (betting window closes)"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "roundId",
            "type": "u64"
          },
          {
            "name": "finalBetCount",
            "type": "u8"
          },
          {
            "name": "totalPot",
            "type": "u64"
          },
          {
            "name": "vrfRequestPubkey",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "gameReset",
      "docs": [
        "Event emitted when game is reset for next round"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "oldRoundId",
            "type": "u64"
          },
          {
            "name": "newRoundId",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "gameRound",
      "docs": [
        "Current game round state stored as PDA per round",
        "Seeds: [b\"game_round\", round_id.to_le_bytes()]",
        "Bets are stored both as separate PDAs AND in arrays for efficient winner selection"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "roundId",
            "type": "u64"
          },
          {
            "name": "status",
            "type": {
              "defined": {
                "name": "gameStatus"
              }
            }
          },
          {
            "name": "startTimestamp",
            "type": "i64"
          },
          {
            "name": "endTimestamp",
            "type": "i64"
          },
          {
            "name": "betCount",
            "type": "u32"
          },
          {
            "name": "totalPot",
            "type": "u64"
          },
          {
            "name": "betAmounts",
            "type": {
              "array": [
                "u64",
                64
              ]
            }
          },
          {
            "name": "winner",
            "type": "pubkey"
          },
          {
            "name": "winningBetIndex",
            "type": "u32"
          },
          {
            "name": "vrfRequestPubkey",
            "type": "pubkey"
          },
          {
            "name": "vrfSeed",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "randomnessFulfilled",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "gameStatus",
      "docs": [
        "Game status enumeration"
      ],
      "repr": {
        "kind": "rust"
      },
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "idle"
          },
          {
            "name": "waiting"
          },
          {
            "name": "awaitingWinnerRandomness"
          },
          {
            "name": "finished"
          }
        ]
      }
    },
    {
      "name": "networkConfiguration",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "treasury",
            "type": "pubkey"
          },
          {
            "name": "requestFee",
            "type": "u64"
          },
          {
            "name": "fulfillmentAuthorities",
            "type": {
              "vec": "pubkey"
            }
          },
          {
            "name": "tokenFeeConfig",
            "type": {
              "option": {
                "defined": {
                  "name": "oraoTokenFeeConfig"
                }
              }
            }
          }
        ]
      }
    },
    {
      "name": "networkState",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "config",
            "type": {
              "defined": {
                "name": "networkConfiguration"
              }
            }
          },
          {
            "name": "numReceived",
            "docs": [
              "Total number of received requests."
            ],
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "oraoTokenFeeConfig",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mint",
            "docs": [
              "ORAO token mint address."
            ],
            "type": "pubkey"
          },
          {
            "name": "treasury",
            "docs": [
              "ORAO token treasury account."
            ],
            "type": "pubkey"
          },
          {
            "name": "fee",
            "docs": [
              "Fee in ORAO SPL token smallest units."
            ],
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "winnerSelected",
      "docs": [
        "Event emitted when winner is determined"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "roundId",
            "type": "u64"
          },
          {
            "name": "winner",
            "type": "pubkey"
          },
          {
            "name": "winningBetIndex",
            "type": "u32"
          },
          {
            "name": "totalPot",
            "type": "u64"
          },
          {
            "name": "houseFee",
            "type": "u64"
          },
          {
            "name": "winnerPayout",
            "type": "u64"
          }
        ]
      }
    }
  ]
};
