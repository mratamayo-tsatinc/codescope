/*
@codescope
@title Integer and Simple If
@seed a min=6 max=9
@seed b min=3 max=6
*/
public class TaskAlpha
{
    public static void main(String[] args)
    {
        int a = 8;
        int b = 5;
        int c;
        int total;

        c = a + b * 2;
        total = c - a;

        if (total > 10) {
            total = total + 3;
            c = c - 2;
        }

        System.out.println("a = " + a);
        System.out.println("b = " + b);
        System.out.println("c = " + c);
        System.out.println("total = " + total);
    }
}
