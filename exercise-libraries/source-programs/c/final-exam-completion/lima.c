/*
@codescope
@title Complete an even-number running sum
*/
#include <stdio.h>

int main()
{
    int n = 2;
    int sum = 0;
    while (n <= 8)
    {
        sum += n;
        printf("sum = %d\n", sum);
        n += 2;
    }
    printf("Final sum = %d\n", sum);
    return 0;
}
