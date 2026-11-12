/*
@codescope
@title Order a do while loop and final message
@seed limit min=2 max=4
*/
#include <stdio.h>

int main()
{
    int i = 1;
    int limit = 3;
    do
    {
        printf("Hello\n");
        i++;
    } while (i <= limit);
    printf("Done\n");
    return 0;
}
