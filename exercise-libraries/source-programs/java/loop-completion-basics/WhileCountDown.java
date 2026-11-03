/*
@codescope
@title Complete a while countdown loop
@seed count min=3 max=6
*/
public class WhileCountDown {
    public static void main(String[] args) {
        int count = 4;

        while (count > 0) {
            System.out.println(count);
            count--;
        }

        System.out.println("LIFT OFF");
        System.out.println("FINAL COUNT: " + count);
    }
}
