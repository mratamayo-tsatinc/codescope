/*
@codescope
@title Trace nested row and column loops
@seed rowLimit min=2 max=3
@seed colLimit min=2 max=4
*/
#include <stdio.h>

int main()
{
    int row;
    int col;
    int rowLimit = 2;
    int colLimit = 3;
    for (row = 1; row <= rowLimit; row++)
    {
        for (col = 1; col <= colLimit; col++)
        {
            printf("row %d col %d\n", row, col);
        }
    }
    return 0;
}
