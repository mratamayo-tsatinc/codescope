/*
@codescope
@title Simulate a descending even-number sum
@seed start min=8 max=10 step=2
*/
public class Golf
{
    public static void main(String[] args)
    {
        int i;
        int sum = 0;
        int count = 0;
        int start = 10;
        int end = 2;
        for (i = start; i >= end; i -= 2)
        {
            sum += i;
            count++;
            System.out.println("Added " + i);
        }
        System.out.println("Sum is " + sum);
        System.out.println("Count is " + count);
    }
}
