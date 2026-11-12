/*
@codescope
@title Complete a counting for loop
*/
#include <stdio.h>

int main()
{
    int i;
    int count = 0;
    for (i = 1; i <= 5; i++)
    {
        count++;
        printf("Number %d\n", i);
    }
    printf("Count = %d\n", count);
    return 0;
}
