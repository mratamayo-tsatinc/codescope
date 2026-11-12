/*
@codescope
@title Complete a loop that skips multiples
*/
#include <stdio.h>

int main()
{
    int i;
    int sum = 0;
    for (i = 1; i <= 8; i++)
    {
        if (i % 3 == 0)
        {
            continue;
        }
        sum += i;
        printf("Added %d\n", i);
    }
    printf("Sum = %d\n", sum);
    return 0;
}
