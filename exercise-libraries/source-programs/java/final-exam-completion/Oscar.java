/*
@codescope
@title Complete nested loops with an early exit
*/
public class Oscar
{
    public static void main(String[] args)
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
                System.out.println("row " + row + " col " + col);
            }
        }
        System.out.println("Count = " + count);
    }
}
