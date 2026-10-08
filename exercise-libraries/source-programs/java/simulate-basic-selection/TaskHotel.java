/*
@codescope
@title Integer, If Else and Simple Switch
@seed a min=4 max=8
@seed b min=7 max=11
*/
public class TaskHotel
{
    public static void main(String[] args)
    {
        int a = 6;
        int b = 9;
        int result;
        int choice;

        result = a * 2 + b;

        if (result > 20) {
            choice = 2;
        } else {
            choice = 1;
        }

        switch (choice) {
            case 1:
                result = result + 5;
                a = a + 1;
                break;

            case 2:
                result = result - 7;
                b = b + 2;
                break;

            default:
                result = 0;
        }

        System.out.println("a = " + a);
        System.out.println("b = " + b);
        System.out.println("choice = " + choice);
        System.out.println("result = " + result);
    }
}
