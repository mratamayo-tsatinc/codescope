/*
@codescope
@title Meal Counter
@seed mealCode min=1 max=4
@seed quantity min=1 max=4
*/
#include <stdio.h>

int main(void)
{
    int mealCode = 2;
    int quantity = 3;
    int unitPrice;

    switch (mealCode)
    {
        case 1:
            unitPrice = 55;
            break;
        case 2:
            unitPrice = 70;
            break;
        case 3:
            unitPrice = 85;
            break;
        default:
            unitPrice = 45;
    }

    printf("MEAL COUNTER\n");
    printf("Order total: P%d\n", unitPrice * quantity);

    return 0;
}

