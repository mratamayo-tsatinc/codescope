/*
@codescope
@title Simulate nested loops with continue
@seed rowLimit min=2 max=4
@seed colLimit min=2 max=4
*/
#include <stdio.h>

int main()
{
    int row;
    int col;
    int count = 0;
    int rowLimit = 3;
    int colLimit = 3;
    for (row = 1; row <= rowLimit; row++)
    {
        for (col = 1; col <= colLimit; col++)
        {
            if (col == row)
            {
                continue;
            }
            count++;
            printf("row %d col %d\n", row, col);
        }
    }
    printf("Count = %d\n", count);
    return 0;
}
