/*
@codescope
@title Complete nested loops with an early exit
*/
#include <stdio.h>

int main()
{
    int row;
    int col;
    int count = 0;
    for (row = 1; row <= 3; row++)
    {
        for (col = 1; col <= 4; col++)
        {
            if (col > row)
            {
                break;
            }
            count++;
            printf("row %d col %d\n", row, col);
        }
    }
    printf("Count = %d\n", count);
    return 0;
}
