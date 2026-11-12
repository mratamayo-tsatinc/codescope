/*
@codescope
@title Order a for loop with a running total
@seed limit min=3 max=5
*/
#include <stdio.h>

int main()
{
    int i;
    int sum = 0;
    int limit = 4;
    for (i = 1; i <= limit; i++)
    {
        sum += i;
        printf("sum = %d\n", sum);
    }
    printf("Total = %d\n", sum);
    return 0;
}
