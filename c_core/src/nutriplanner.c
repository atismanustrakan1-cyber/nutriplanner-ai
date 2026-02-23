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
        target += 300;
    if (target < 1200) target = 1200;
    if (target > 4500) target = 4500;
    return target;
}

np_macros_t np_macro_targets(int calories, double weight_kg) {
    np_macros_t result = {0, 0, 0, 0};

    if(calories <= 0 || weight_kg <=0)
        return result;

    //This is the base
    int protein = (int)round(1.6 * weight_kg);
    int fat = (int)round(0.8 * weight_kg);

    int remaining = calories - ((protein * 4) + (fat * 9));
    int carbs = remaining > 0 ? remaining / 4 : 0;

    result.calories = calories;
    result.protein_g = protein;
    result.fat_g = fat;
    result.carbs_g = carbs;

    return result;
}

//prepares struct
void np_daylog_init(np_daylog_t *log){
    if(!log)
        return;
    log->meals = NULL;
    log->count = 0;
    log->capacity = 0;
}

//free memory AND reset the struct
void np_daylog_free(np_daylog_t *log){
    if(!log)
        return;
    free(log->meals);
    log->meals = NULL;
    log->count = 0;
    log->capacity = 0;
}

int np_daylog_add_meal(np_daylog_t *log, np_meal_t meal){
    if(!log)
        return 0;
    if(log->count == log->capacity){
        size_t updatedCapacity = (log->capacity == 0) ? 4 : log->capacity * 2;
        np_meal_t *updatedMeals = realloc(log->meals, updatedCapacity * sizeof(np_meal_t));
        if(!updatedMeals) return 0;

        log->meals = updatedMeals;
        log->capacity = updatedCapacity;
    }
    log->meals[log->count] = meal;
    log->count++;
    return 1;
}

np_meal_t np_daylog_totals(const np_daylog_t *log){
    np_meal_t totals = {0,0,0,0};
    if(!log) return totals;

    for(size_t i=0; i<log->count; i++){
        totals.calories += log->meals[i].calories;
        totals.protein_g += log->meals[i].protein_g;
        totals.carbs_g += log->meals[i].carbs_g;
        totals.fat_g += log->meals[i].fat_g;
    }
    return totals;
}
