/*
@codescope
@title Integer If Else If (2), and Switch
@seed a min=5 max=9
@seed b min=2 max=6
@seed c min=1 max=5
@seed bonus min=3 max=7
*/
public class TaskJuliet
{
    public static void main(String[] args)
    {
        int a = 7;
        int b = 4;
        int c = 3;
        int total;
        int level;
        int bonus = 5;
        int result;

        total = a * b + c;

        if (total > 30) {
            total = total - 5;
            bonus = bonus + 2;
        }

        if (total >= 25) {
            level = 3;
        } else if (total >= 20) {
            level = 2;
        } else {
            level = 1;
        }

        if (level == 3) {
            if (bonus >= 7) {
                result = total + bonus;
            } else {
                result = total - bonus;
            }
        } else {
            result = total + level;
        }

        switch (level) {
            case 1:
                result = result + 2;
                a = a + 1;
                break;

            case 2:
                result = result * 2;
                b = b + 2;
                break;

            case 3:
                result = result - 3;
                c = c + 4;
                break;

            default:
                result = 0;
        }

        total = total + a - b + c;

        System.out.println("a = " + a);
        System.out.println("b = " + b);
        System.out.println("c = " + c);
        System.out.println("total = " + total);
        System.out.println("level = " + level);
        System.out.println("bonus = " + bonus);
        System.out.println("result = " + result);
    }
}
