/*
@codescope
@title Complete a while count up loop
@seed limit min=3 max=6
*/
public class WhileCountUp {
    public static void main(String[] args) {
        int count = 1;
        int limit = 4;

        while (count <= limit) {
            System.out.println(count);
            count++;
        }

        System.out.println("FINAL COUNT: " + count);
    }
}
