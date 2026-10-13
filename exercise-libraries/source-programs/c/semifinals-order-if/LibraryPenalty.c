/*
@codescope
@title Library Penalty
@seed lateDays min=2 max=10 step=2
@seed dailyFine min=5 max=15 step=5
@seed processingFee min=10 max=30 step=10
*/
#include <stdio.h>

int main(void)
{
    int lateDays = 6;
    int dailyFine = 10;
    int processingFee = 20;
    int penalty;

    penalty = lateDays * dailyFine;

    if (lateDays > 5) {
        penalty = penalty + processingFee;
    }

    printf("LIBRARY RETURN\n");
    printf("Late period: %d days\n", lateDays);
    printf("Penalty due: P%d\n", penalty);

    return 0;
}

