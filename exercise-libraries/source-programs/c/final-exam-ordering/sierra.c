/*
@codescope
@title Order a for loop that stops early
@seed stopValue min=3 max=5
*/
#include <stdio.h>

int main()
{
    int i;
    int limit = 6;
    int stopValue = 4;
    for (i = 1; i <= limit; i++)
    {
        if (i == stopValue)
        {
            break;
        }
        printf("i = %d\n", i);
    }
    printf("Stopped\n");
    return 0;
}
