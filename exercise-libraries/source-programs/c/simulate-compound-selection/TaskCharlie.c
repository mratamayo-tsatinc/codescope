/*
@codescope
@title Tuitio Fee Computation
@seed credits min=16 max=20
@seed units min=1 max=3
@seed labFee min=65 max=100 step=5
@seed baseFee min=600 max=900 step=100
*/
#include <stdio.h>

int main(void)
{
    int credits = 18, units = 3, labFee = 75, baseFee = 900;
    int totalFee, enrolled;

    totalFee = baseFee + units * labFee - credits / 6 * 10;
    enrolled = (credits >= 12 && units >= 3) || !((credits < 6));

    if (enrolled && totalFee < 1000) {
        totalFee = totalFee + 50;
    } else if (!enrolled || credits > 24) {
        totalFee = totalFee + 100;
    } 
    
    printf("credits = %d\n", credits);
    printf("units = %d\n", units);
    printf("labFee = %d\n", labFee);
    printf("baseFee = %d\n", baseFee);
    printf("totalFee = %d\n", totalFee);
    printf("enrolled = %d\n", enrolled);
    return 0;
}
