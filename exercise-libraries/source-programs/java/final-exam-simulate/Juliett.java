/*
@codescope
@title Simulate nested loops with continue
@seed rowLimit min=3 max=4
*/
public class Juliett
{
    public static void main(String[] args)
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
                System.out.println("row " + row + " col " + col);
            }
        }
        System.out.println("Count = " + count);
    }
}
