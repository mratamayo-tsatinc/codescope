/*
@codescope
@title Complete a do while count up loop
@seed limit min=3 max=6
*/
public class DoWhileCountUp {
    public static void main(String[] args) {
        int count = 1;
        int limit = 4;

        do {
            System.out.println(count);
            count++;
        } while (count <= limit);

        System.out.println("FINAL COUNT: " + count);
    }
}
