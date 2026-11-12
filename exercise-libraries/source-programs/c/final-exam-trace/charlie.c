/*
@codescope
@title Trace a do while running sum
@seed limit min=3 max=4
*/
#include <stdio.h>

int main()
{
    int i = 1;
    int sum = 0;
    int limit = 4;
    do
    {
        sum += i;
        printf("sum = %d\n", sum);
        i++;
    } while (i <= limit);
    return 0;
}
