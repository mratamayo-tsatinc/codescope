/*
@codescope
@title Trace nested row and column loops
@seed colLimit min=2 max=4
*/
public class Echo
{
    public static void main(String[] args)
    {
        int row;
        int col;
        int rowLimit = 2;
        int colLimit = 3;
        for (row = 1; row <= rowLimit; row++)
        {
            for (col = 1; col <= colLimit; col++)
            {
                System.out.println("row " + row + " col " + col);
            }
        }

        System.out.println("===END===");
    }
}
