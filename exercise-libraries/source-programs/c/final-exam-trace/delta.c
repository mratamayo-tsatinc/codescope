/*
@codescope
@title Trace a for loop with continue
@seed limit min=5 max=6
@seed skippedValue min=2 max=4
*/
#include <stdio.h>

int main()
{
    int i;
    int sum = 0;
    int limit = 5;
    int skippedValue = 3;
    for (i = 1; i <= limit; i++)
    {
        if (i == skippedValue)
        {
            continue;
        }
        sum += i;
        printf("sum = %d\n", sum);
    }
    return 0;
}
