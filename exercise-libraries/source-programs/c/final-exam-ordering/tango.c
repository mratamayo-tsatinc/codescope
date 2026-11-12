/*
@codescope
@title Order nested loops with row summaries
@seed rowLimit min=2 max=4
@seed colLimit min=2 max=4
*/
#include <stdio.h>

int main()
{
    int row;
    int col;
    int rowLimit = 3;
    int colLimit = 2;
    for (row = 1; row <= rowLimit; row++)
    {
        for (col = 1; col <= colLimit; col++)
        {
            printf("row %d col %d\n", row, col);
        }
        printf("End of row %d\n", row);
    }
    return 0;
}
