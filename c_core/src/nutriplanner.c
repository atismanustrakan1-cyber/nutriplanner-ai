// This is where we implement the functions declared in nutriplanner.h
#include "nutriplanner/nutriplanner.h"
#include <stdlib.h>
#include <math.h>

int np_daily_calorie_target(double weight_kg, np_goal_t goal) {
    if (weight_kg <= 0) return -1;
    int base = (int)round(30 * weight_kg);
    int target = base;
    if(goal == NP_GOAL_LOSS)
        target -= 500;
    else if(goal == NP_GOAL_GAIN)
        target +=300;
    if (target < 1200) target = 1200;
    if (target > 4500) target = 4500;
    return target;
}

np_macros_t np_macro_targets(int calories, double weight_kg) {
    np_macros_t result = {0, 0, 0, 0};

    if(calories ≤ 0 || weight_kg <=0)
        return result;

    //This is the base
    int protein = (int)round(1.6 * weight_kg);
    int fat = (int)round(0.8 * weight_kg);

    int remaining = calories - ((protein * 4) + (fat * 9));
    int carbs = remaining > 0 ? remaining_cal / 4 : 0;

    result.calories = calories;
    result.protein_g = protein;
    result.fat_g = fat;
    result.carbs_g = carbs;

    return result;
}
