/*
@codescope
@title Trace a simple while loop
@seed limit min=3 max=4
*/
#include <stdio.h>

int main()
{
    int i = 1;
    int limit = 4;
    while (i <= limit)
    {
        printf("Hello\n");
        i++;
    }
    return 0;
}
