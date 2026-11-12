/*
@codescope
@title Trace a counting for loop
@seed limit min=4 max=5
*/
#include <stdio.h>

int main()
{
    int i;
    int limit = 5;
    for (i = 1; i <= limit; i++)
    {
        printf("Count: %d\n", i);
    }
    return 0;
}
