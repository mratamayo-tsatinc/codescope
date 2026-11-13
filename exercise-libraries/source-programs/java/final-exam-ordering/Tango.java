/*
@codescope
@title Order nested loops with row summaries
@seed rowLimit min=2 max=4
*/
public class Tango
{
    public static void main(String[] args)
    {
        int row;
        int col;
        int rowLimit = 3;
        int colLimit = 2;
        for (row = 1; row <= rowLimit; row++)
        {
            for (col = 1; col <= colLimit; col++)
            {
                System.out.println("row " + row + " col " + col);
            }
            System.out.println("End of row " + row);
        }
    }
}
