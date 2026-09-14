// InsightFlow Retention Demo Dataset

export const retentionDemoData = {
  definition: {
    event: "app_open",
    returningEvent: "app_open",
    period: "weekly",
    window: "30 days",
    segment: "All Users",
  },

  summary: {
    currentRetention: 62.4,
    previousRetention: 70.8,
    change: -8.4,
    currentCohort: "2026-09-16",
    cohortUsers: 2380,
    retainedUsers: 1485,
    lostUsers: 895,
  },

  baselineIntervals: [
    {
      day: 0,
      users: 2380,
      rate: 100,
    },
    {
      day: 1,
      users: 1685,
      rate: 70.8,
    },
    {
      day: 3,
      users: 1499,
      rate: 63,
    },
    {
      day: 7,
      users: 1285,
      rate: 54,
    },
    {
      day: 14,
      users: 1023,
      rate: 43,
    },
    {
      day: 30,
      users: 738,
      rate: 31,
    },
  ],

  cohorts: [
  {
    "date": "2026-07-01",
    "users": 1420,
    "intervals": [
      {
        "day": 0,
        "users": 1420,
        "rate": 100
      },
      {
        "day": 1,
        "users": 1037,
        "rate": 73
      },
      {
        "day": 3,
        "users": 923,
        "rate": 65
      },
      {
        "day": 7,
        "users": 738,
        "rate": 52
      },
      {
        "day": 14,
        "users": 596,
        "rate": 42
      },
      {
        "day": 30,
        "users": 355,
        "rate": 25
      }
    ]
  },
  {
    "date": "2026-07-08",
    "users": 1680,
    "intervals": [
      {
        "day": 0,
        "users": 1680,
        "rate": 100
      },
      {
        "day": 1,
        "users": 1210,
        "rate": 72
      },
      {
        "day": 3,
        "users": 1075,
        "rate": 64
      },
      {
        "day": 7,
        "users": 823,
        "rate": 49
      },
      {
        "day": 14,
        "users": 655,
        "rate": 39
      },
      {
        "day": 30,
        "users": 386,
        "rate": 23
      }
    ]
  },
  {
    "date": "2026-07-15",
    "users": 1900,
    "intervals": [
      {
        "day": 0,
        "users": 1900,
        "rate": 100
      },
      {
        "day": 1,
        "users": 1425,
        "rate": 75
      },
      {
        "day": 3,
        "users": 1273,
        "rate": 67
      },
      {
        "day": 7,
        "users": 969,
        "rate": 51
      },
      {
        "day": 14,
        "users": 779,
        "rate": 41
      },
      {
        "day": 30,
        "users": 437,
        "rate": 23
      }
    ]
  },
  {
    "date": "2026-07-22",
    "users": 1750,
    "intervals": [
      {
        "day": 0,
        "users": 1750,
        "rate": 100
      },
      {
        "day": 1,
        "users": 1225,
        "rate": 70
      },
      {
        "day": 3,
        "users": 1085,
        "rate": 62
      },
      {
        "day": 7,
        "users": 822,
        "rate": 47
      },
      {
        "day": 14,
        "users": 648,
        "rate": 37
      },
      {
        "day": 30,
        "users": 385,
        "rate": 22
      }
    ]
  },
  {
    "date": "2026-07-29",
    "users": 2100,
    "intervals": [
      {
        "day": 0,
        "users": 2100,
        "rate": 100
      },
      {
        "day": 1,
        "users": 1428,
        "rate": 68
      },
      {
        "day": 3,
        "users": 1260,
        "rate": 60
      },
      {
        "day": 7,
        "users": 945,
        "rate": 45
      },
      {
        "day": 14,
        "users": 735,
        "rate": 35
      },
      {
        "day": 30,
        "users": 441,
        "rate": 21
      }
    ]
  },
  {
    "date": "2026-08-05",
    "users": 1980,
    "intervals": [
      {
        "day": 0,
        "users": 1980,
        "rate": 100
      },
      {
        "day": 1,
        "users": 1327,
        "rate": 67
      },
      {
        "day": 3,
        "users": 1168,
        "rate": 59
      },
      {
        "day": 7,
        "users": 871,
        "rate": 44
      },
      {
        "day": 14,
        "users": 673,
        "rate": 34
      },
      {
        "day": 30,
        "users": 396,
        "rate": 20
      }
    ]
  },
  {
    "date": "2026-08-12",
    "users": 2250,
    "intervals": [
      {
        "day": 0,
        "users": 2250,
        "rate": 100
      },
      {
        "day": 1,
        "users": 1552,
        "rate": 69
      },
      {
        "day": 3,
        "users": 1372,
        "rate": 61
      },
      {
        "day": 7,
        "users": 1035,
        "rate": 46
      },
      {
        "day": 14,
        "users": 810,
        "rate": 36
      },
      {
        "day": 30,
        "users": 472,
        "rate": 21
      }
    ]
  },
  {
    "date": "2026-08-19",
    "users": 2400,
    "intervals": [
      {
        "day": 0,
        "users": 2400,
        "rate": 100
      },
      {
        "day": 1,
        "users": 1560,
        "rate": 65
      },
      {
        "day": 3,
        "users": 1368,
        "rate": 57
      },
      {
        "day": 7,
        "users": 1032,
        "rate": 43
      },
      {
        "day": 14,
        "users": 792,
        "rate": 33
      },
      {
        "day": 30,
        "users": 456,
        "rate": 19
      }
    ]
  },
  {
    "date": "2026-08-26",
    "users": 2180,
    "intervals": [
      {
        "day": 0,
        "users": 2180,
        "rate": 100
      },
      {
        "day": 1,
        "users": 1395,
        "rate": 64
      },
      {
        "day": 3,
        "users": 1221,
        "rate": 56
      },
      {
        "day": 7,
        "users": 916,
        "rate": 42
      },
      {
        "day": 14,
        "users": 698,
        "rate": 32
      },
      {
        "day": 30,
        "users": 392,
        "rate": 18
      }
    ]
  },
  {
    "date": "2026-09-02",
    "users": 2320,
    "intervals": [
      {
        "day": 0,
        "users": 2320,
        "rate": 100
      },
      {
        "day": 1,
        "users": 1462,
        "rate": 63
      },
      {
        "day": 3,
        "users": 1276,
        "rate": 55
      },
      {
        "day": 7,
        "users": 928,
        "rate": 40
      },
      {
        "day": 14,
        "users": 696,
        "rate": 30
      },
      {
        "day": 30,
        "users": 441,
        "rate": 19
      }
    ]
  },
  {
    "date": "2026-09-09",
    "users": 2450,
    "intervals": [
      {
        "day": 0,
        "users": 2450,
        "rate": 100
      },
      {
        "day": 1,
        "users": 1494,
        "rate": 61
      },
      {
        "day": 3,
        "users": 1298,
        "rate": 53
      },
      {
        "day": 7,
        "users": 956,
        "rate": 39
      },
      {
        "day": 14,
        "users": 710,
        "rate": 29
      },
      {
        "day": 30,
        "users": 441,
        "rate": 18
      }
    ]
  },
  {
    "date": "2026-09-16",
    "users": 2380,
    "intervals": [
      {
        "day": 0,
        "users": 2380,
        "rate": 100
      },
      {
        "day": 1,
        "users": 1476,
        "rate": 62
      },
      {
        "day": 3,
        "users": 1285,
        "rate": 54
      },
      {
        "day": 7,
        "users": 976,
        "rate": 41
      },
      {
        "day": 14,
        "users": 738,
        "rate": 31
      },
      {
        "day": 30,
        "users": 476,
        "rate": 20
      }
    ]
  }
],

  breakdowns: {
    platform: [
      { name: "iOS", users: 9200, D1: 76, D7: 54, D30: 31 },
      { name: "Android", users: 9800, D1: 63, D7: 41, D30: 22 },
      { name: "Web", users: 2300, D1: 58, D7: 35, D30: 18 },
    ],
    userType: [
      { name: "Free", users: 15000, D1: 60, D7: 38, D30: 19 },
      { name: "Pro", users: 5000, D1: 82, D7: 64, D30: 45 },
      { name: "Enterprise", users: 1500, D1: 91, D7: 78, D30: 62 },
    ],
  },

  diagnosis: {
    severity: "medium",
    finding: "Android retention is lower than baseline and requires investigation.",
    evidence: [
      { metric: "D7 Retention", segment: "Android", value: 41, baseline: 54 },
      { metric: "Affected users", value: 9800 },
    ],
    recommendation: [
      "Investigate Android onboarding completion",
      "Compare notification engagement",
      "Review latest release impact",
    ],
  },
};
