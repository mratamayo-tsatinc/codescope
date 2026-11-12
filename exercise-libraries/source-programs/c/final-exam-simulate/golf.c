/*
@codescope
@title Simulate a descending even-number sum
@seed start min=8 max=10 step=2
*/
#include <stdio.h>

int main()
{
    int i;
    int sum = 0;
    int count = 0;
    int start = 10;
    int end = 2;
    for (i = start; i >= end; i -= 2)
    {
        sum += i;
        count++;
        printf("Added %d\n", i);
    }
    printf("Sum is %d\n", sum);
    printf("Count is %d\n", count);
    return 0;
}
