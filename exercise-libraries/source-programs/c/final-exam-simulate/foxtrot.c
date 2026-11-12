/*
@codescope
@title Simulate a while loop running total
@seed limit min=4 max=5
*/
#include <stdio.h>

int main()
{
    int n = 1;
    int total = 0;
    int limit = 5;
    while (n <= limit)
    {
        total += n;
        printf("n = %d total = %d\n", n, total);
        n++;
    }
    printf("Final total = %d\n", total);
    return 0;
}
