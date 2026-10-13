/*
@codescope
@title School Canteen Order
@seed mealPrice min=45 max=75 step=5
@seed drinkPrice min=15 max=30 step=5
@input target=meals value=2 min=1 max=6
@input target=drinks value=2 min=0 max=6
*/
#include <stdio.h>

int main(void)
{
    int meals;
    int drinks;
    int mealPrice = 60;
    int drinkPrice = 20;
    int canteenTotal;

    printf("Meal orders: ");
    scanf("%d", &meals);
    printf("Drink orders: ");
    scanf("%d", &drinks);
    canteenTotal = meals * mealPrice + drinks * drinkPrice;

    printf("CANTEEN CLAIM\n");
    printf("Meals prepared: %d\n", meals);
    printf("Drinks prepared: %d\n", drinks);
    printf("Amount due: P%d\n", canteenTotal);

    return 0;
}

