/*
@codescope
@title Complete a do while classification loop
*/
#include <stdio.h>

int main()
{
    int n = 1;
    int big = 0;
    do
    {
        if (n > 3)
        {
            big++;
            printf("%d is big\n", n);
        }
        else
        {
            printf("%d is small\n", n);
        }
        n++;
    } while (n <= 6);
    printf("Big count = %d\n", big);
    return 0;
}
