/*
@codescope
@title Simulate a running total with an early stop
@seed limit min=8 max=12
@seed stopTotal min=8 max=15
*/
#include <stdio.h>

int main()
{
    int n = 1;
    int total = 0;
    int limit = 10;
    int stopTotal = 10;
    while (n <= limit)
    {
        total += n;
        if (total > stopTotal)
        {
            break;
        }
        printf("total = %d\n", total);
        n++;
    }
    printf("Stopped at n = %d\n", n);
    printf("Total = %d\n", total);
    return 0;
}
