//This will be where we define the structs and functions for the nutriplanner module
#ifndef NUTRIPLANNER_H
#define NUTRIPLANNER_H

#include <stddef.h>

// Goal selection for daily calorie target
typedef enum {
    NP_GOAL_LOSS = -1,
    NP_GOAL_MAINTAIN = 0,
    NP_GOAL_GAIN = 1
} np_goal_t;

// Macro targets (and a convenient way to return calories + grams together)
typedef struct {
    int calories;
    int protein_g;
    int carbs_g;
    int fat_g;
} np_macros_t;

// A single meal entry (what the user ate)
typedef struct {
    int calories;
    int protein_g;
    int carbs_g;
    int fat_g;
} np_meal_t;

typedef struct {
    boolean sex; // 0 = female, 1 = male
    int weight_kg;
    int height_cm;
    int age_years;
} np_user_t;


// A day log = dynamic array of meals for the day (DMA)
typedef struct {
    np_meal_t *meals;
    size_t count;
    size_t capacity;
} np_daylog_t;



// Returns the recommended daily calorie target.
// MVP heuristic:
//   base = round(30 * weight_kg)
//   loss: base - 500, gain: base + 300, maintain: base
//   clamp to [1200, 4500]
// Returns -1 if weight_kg <= 0.
int np_daily_calorie_target(double weight_kg, np_goal_t goal);

// Returns macro targets for a given calorie target.
// MVP heuristic:
//   protein_g = round(1.6 * weight_kg)
//   fat_g     = round(0.8 * weight_kg)
//   carbs_g   = max(0, (calories - (protein*4 + fat*9)) / 4)
// Returns all zeros if calories <= 0 or weight_kg <= 0.
np_macros_t np_macro_targets(int calories, double weight_kg);

// Day log lifecycle
void np_daylog_init(np_daylog_t *log);
void np_daylog_free(np_daylog_t *log);

// Adds a meal to the day log.
// Returns 1 on success, 0 on allocation failure or bad log pointer.
int np_daylog_add_meal(np_daylog_t *log, np_meal_t meal);

// Returns totals for the day (sum of all meals).
np_meal_t np_daylog_totals(const np_daylog_t *log);

#endif
