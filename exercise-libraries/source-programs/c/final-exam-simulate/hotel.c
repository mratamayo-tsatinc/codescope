/*
@codescope
@title Simulate even and odd counting
@seed limit min=6 max=8
*/
#include <stdio.h>

int main()
{
    int i;
    int even = 0;
    int odd = 0;
    int limit = 7;
    for (i = 1; i <= limit; i++)
    {
        if (i % 2 == 0)
        {
            even++;
            printf("%d is even\n", i);
        }
        else
        {
            odd++;
            printf("%d is odd\n", i);
        }
    }
    printf("Even = %d\n", even);
    printf("Odd = %d\n", odd);
    return 0;
}
