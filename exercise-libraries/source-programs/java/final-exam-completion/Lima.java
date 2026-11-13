/*
@codescope
@title Complete an even-number running sum
*/
public class Lima
{
    public static void main(String[] args)
    {
        int n = 2;
        int sum = 0;
        while (n <= 8)
        {
            sum += n;
            System.out.println("sum = " + sum);
            n += 2;
        }
        System.out.println("Final sum = " + sum);
    }
}
