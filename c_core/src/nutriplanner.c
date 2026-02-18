// This is where we implement the functions declared in nutriplanner.h
#include "nutriplanner/nutriplanner.h"
#include <stdlib.h>
#include <math.h>

int np_daily_calorie_target(double weight_kg, np_goal_t goal) {
    if (weight_kg <= 0) return -1;
    int base = (int)round(30 * weight_kg);
    int target = base + goal * (goal == NP_GOAL_LOSS ? -500 : 300);
    if (target < 1200) target = 1200;
    if (target > 4500) target = 4500;
    return target;
}

