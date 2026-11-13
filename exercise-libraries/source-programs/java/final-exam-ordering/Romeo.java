/*
@codescope
@title Order a do while loop and final message
@seed limit min=2 max=4
*/
public class Romeo
{
    public static void main(String[] args)
    {
        int i = 1;
        int limit = 3;
        do
        {
            System.out.println("Hello");
            i++;
        } while (i <= limit);
        System.out.println("Done");
    }
}
